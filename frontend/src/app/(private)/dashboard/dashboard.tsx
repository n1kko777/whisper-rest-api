"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import withAuth from "@/components/withAuth";
import {
  deleteTask,
  getTaskStatus,
  getTasks,
  transcribeFile,
  TaskStatus,
} from "@/lib/api";
import { useReactMediaRecorder } from "react-media-recorder";
import { FileAudio, Mic, Square, Trash } from "lucide-react";

interface Task {
  id: string;
  name: string;
  status: TaskStatus;
  result: string;
  createdAt?: string;
}

const TASK_NAMES_STORAGE_KEY = "taskNames";

const readStoredTaskNames = (): Record<string, string> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(TASK_NAMES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.error("Failed to read stored task names:", error);
    return {};
  }
};

const rememberTaskName = (taskId: string, fileName: string) => {
  if (typeof window === "undefined") return;
  const names = readStoredTaskNames();
  names[taskId] = fileName;
  try {
    localStorage.setItem(TASK_NAMES_STORAGE_KEY, JSON.stringify(names));
  } catch (error) {
    console.error("Failed to persist task name:", error);
  }
};

const forgetTaskName = (taskId: string) => {
  if (typeof window === "undefined") return;
  const names = readStoredTaskNames();
  delete names[taskId];
  try {
    localStorage.setItem(TASK_NAMES_STORAGE_KEY, JSON.stringify(names));
  } catch (error) {
    console.error("Failed to persist task name removal:", error);
  }
};

const sortTasksByNewest = (taskList: Task[]) =>
  [...taskList].sort(
    (a, b) =>
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );

function DashboardPage() {
  const [file, setFile] = useState<File | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const { status, startRecording, stopRecording, mediaBlobUrl, clearBlobUrl } =
    useReactMediaRecorder({ audio: true });
  const [recordingStart, setRecordingStart] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [microphoneStatus, setMicrophoneStatus] = useState<
    "unknown" | "granted" | "denied" | "prompt"
  >("unknown");
  const [permissionError, setPermissionError] = useState("");
  const router = useRouter();
  const isRecording = status === "recording";
  const canUploadRecording = Boolean(mediaBlobUrl) && !isRecording;

  const handleUnauthorized = useCallback(() => {
    localStorage.removeItem("token");
    router.replace("/login");
  }, [router]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      return;
    }

    const storedNames = readStoredTaskNames();

    const loadTasks = async () => {
      try {
        const response = await getTasks(token);
        const mappedTasks = response.data.map((task) => ({
          id: task.id,
          name: storedNames[task.id] || task.id,
          status: task.status,
          result: task.result || "",
          createdAt: task.created_at,
        }));
        setTasks(sortTasksByNewest(mappedTasks));
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          handleUnauthorized();
          return;
        }
        console.error("Error fetching tasks:", error);
      }
    };

    loadTasks();
  }, [handleUnauthorized]);

  useEffect(() => {
    if (!tasks.length) {
      return;
    }

    const interval = setInterval(() => {
      const token = localStorage.getItem("token");
      if (token) {
        tasks.forEach(async (task) => {
          const normalizedStatus = task.status?.toUpperCase?.() || task.status;
          if (normalizedStatus === "PENDING" || normalizedStatus === "PROCESSING") {
            try {
              const response = await getTaskStatus(task.id, token);
              const updatedTask = response.data;
              setTasks((prevTasks) =>
                sortTasksByNewest(
                  prevTasks.map((t) =>
                    t.id === updatedTask.id
                      ? {
                          ...t,
                          status: updatedTask.status,
                          result: updatedTask.result || "",
                        }
                      : t
                  )
                )
              );
            } catch (error) {
              if (axios.isAxiosError(error) && error.response?.status === 401) {
                handleUnauthorized();
                return;
              }
              console.error(`Error fetching status for task ${task.id}:`, error);
            }
          }
        });
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [handleUnauthorized, tasks]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) {
      return;
    }

    const updateState = (state: PermissionState) => {
      setMicrophoneStatus(
        state === "granted" ? "granted" : state === "denied" ? "denied" : "prompt"
      );
    };

    const checkPermission = async () => {
      try {
        const permission = await navigator.permissions.query({
          name: "microphone" as PermissionName,
        });
        updateState(permission.state);
        permission.onchange = () => updateState(permission.state);
      } catch (error) {
        console.error("Unable to check microphone permission:", error);
      }
    };

    checkPermission();
  }, []);

  useEffect(() => {
    if (!isRecording) {
      setRecordingStart(null);
      setElapsedMs(0);
      return;
    }

    const start = recordingStart ?? Date.now();
    if (recordingStart === null) {
      setRecordingStart(start);
    }

    const interval = window.setInterval(
      () => setElapsedMs(Date.now() - start),
      200
    );

    return () => clearInterval(interval);
  }, [isRecording, recordingStart]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFile(event.target.files[0]);
    }
  };

  const uploadFile = async (fileToUpload: File) => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const response = await transcribeFile(fileToUpload, token);
        const newTask = {
          id: response.data.task_id,
          name: fileToUpload.name,
          status: "PENDING" as TaskStatus,
          result: "",
          createdAt: new Date().toISOString(),
        };
        rememberTaskName(newTask.id, newTask.name);
        setTasks((prevTasks) => sortTasksByNewest([newTask, ...prevTasks]));
      } catch (error) {
        console.error("Error uploading file:", error);
      }
    }
  };

  const handleUpload = async () => {
    if (file) {
      uploadFile(file);
    }
  };

  const handleRecordedAudio = async () => {
    if (!mediaBlobUrl) return;

    const audioBlob = await fetch(mediaBlobUrl).then((r) => r.blob());
    const audioFile = new File([audioBlob], "recorded_audio.wav", {
      type: "audio/wav",
    });
    uploadFile(audioFile);
  };

  const handleClearRecording = () => {
    clearBlobUrl();
    setRecordingStart(null);
    setElapsedMs(0);
  };

  const ensureMicrophonePermission = async () => {
    setPermissionError("");
    if (typeof navigator === "undefined") return true;

    try {
      if (navigator.permissions?.query) {
        const permission = await navigator.permissions.query({
          name: "microphone" as PermissionName,
        });
        if (permission.state === "denied") {
          setMicrophoneStatus("denied");
          setPermissionError(
            "Microphone access is blocked. Please allow it to start recording."
          );
          return false;
        }

        if (permission.state === "granted") {
          setMicrophoneStatus("granted");
          return true;
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMicrophoneStatus("granted");
      return true;
    } catch (error) {
      console.error("Microphone permission denied:", error);
      setMicrophoneStatus("denied");
      setPermissionError(
        "Microphone permission is required to record audio. Please enable it in your browser."
      );
      return false;
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      stopRecording();
      return;
    }

    const allowed = await ensureMicrophonePermission();
    if (!allowed) return;

    startRecording();
  };

  const handleDeleteTask = async (taskId: string) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      await deleteTask(taskId, token);
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 404) {
        console.error(`Error deleting task ${taskId}:`, error);
        return;
      }
    }

    forgetTaskName(taskId);
    setTasks((prevTasks) => prevTasks.filter((task) => task.id !== taskId));
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <Tabs defaultValue="record" className="w-full">
        <TabsList className="mx-auto grid w-full max-w-xl grid-cols-2 gap-2 rounded-full bg-muted p-0">
          <TabsTrigger
            value="record"
            className="flex w-full items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <Mic className="h-4 w-4" />
            Record
          </TabsTrigger>
          <TabsTrigger
            value="upload"
            className="flex w-full items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <FileAudio className="h-4 w-4" />
            File
          </TabsTrigger>
        </TabsList>
        <TabsContent value="record" className="mt-6">
          <Card className="rounded-3xl border-0 bg-white/90 shadow-md shadow-slate-200 ring-1 ring-slate-100">
            <CardHeader className="text-center">
              <CardTitle className="text-xl font-semibold text-slate-900">
                Record your voice
              </CardTitle>
              <CardDescription className="text-base text-slate-600">
                Start recording, then send the file for transcription.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6 p-6 sm:p-8">
              <div className="flex flex-col items-center gap-4 text-center">
                <Button
                  type="button"
                  aria-pressed={isRecording}
                  onClick={toggleRecording}
                  className={cn(
                    "flex h-24 w-24 items-center justify-center rounded-full shadow-lg shadow-black/10 transition-transform duration-150 hover:scale-105 sm:h-28 sm:w-28",
                    isRecording
                      ? "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive"
                      : "bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary"
                  )}
                  size="icon"
                >
                  {isRecording ? (
                    <Square className="h-8 w-8 sm:h-9 sm:w-9" />
                  ) : (
                    <Mic className="h-8 w-8 sm:h-9 sm:w-9" />
                  )}
                </Button>
                <p className="text-sm text-slate-700 sm:text-base">
                  {isRecording
                    ? "Tap to stop recording"
                    : "Tap to start recording"}
                </p>
                <p className="text-xs text-slate-500">
                  {isRecording && (
                    <span className="ml-2 font-semibold text-slate-700">
                      {new Date(Math.max(0, elapsedMs)).toISOString().substring(14, 19)}
                    </span>
                  )}
                </p>
                {permissionError ? (
                  <p className="text-xs text-destructive">{permissionError}</p>
                ) : microphoneStatus === "denied" ? (
                  <p className="text-xs text-amber-600">
                    Microphone access is blocked. Update your browser settings to
                    record.
                  </p>
                ) : null}
              </div>
              {mediaBlobUrl && !isRecording ? (
                <div className="flex w-full flex-col gap-3 rounded-2xl bg-slate-50/80 p-4 shadow-inner ring-1 ring-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-800">
                      Recorded audio
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2 text-slate-700 hover:text-destructive"
                      onClick={handleClearRecording}
                    >
                      <Trash className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                  <audio
                    className="w-full rounded-xl ring-1 ring-slate-200"
                    src={mediaBlobUrl}
                    controls
                  />
                  <p className="text-xs text-slate-500">
                    Listen back before sending to transcription or delete to
                    record again.
                  </p>
                </div>
              ) : null}
              <Button
                onClick={handleRecordedAudio}
                disabled={!canUploadRecording}
                className="w-full rounded-2xl bg-primary px-6 py-4 text-base font-semibold text-primary-foreground shadow-lg shadow-black/10 transition-transform duration-150 hover:translate-y-[-1px] hover:bg-primary/90 focus-visible:ring-primary disabled:translate-y-0"
              >
                Transcribe to text
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="upload" className="mt-6">
          <Card className="rounded-3xl border-0 bg-white/90 shadow-md shadow-slate-200 ring-1 ring-slate-100">
            <CardHeader className="space-y-2">
              <CardTitle className="text-xl font-semibold text-slate-900">
                Upload audio
              </CardTitle>
              <CardDescription className="text-base text-slate-600">
                Choose a file and send it for transcription.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 p-6 sm:p-8">
              <Input
                type="file"
                onChange={handleFileChange}
                className="h-auto cursor-pointer rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 px-4 py-3 text-sm file:mr-3 file:rounded-lg file:bg-white file:px-4 file:py-2 file:font-medium hover:border-slate-300"
              />
              <Button
                onClick={handleUpload}
                className="w-full rounded-xl bg-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-md shadow-black/10 hover:bg-primary/90 focus-visible:ring-primary"
              >
                Upload and transcribe
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="rounded-3xl border-0 bg-white/90 shadow-md shadow-slate-200 ring-1 ring-slate-100">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-slate-900">
            Transcription history
          </CardTitle>
          <CardDescription className="text-base text-slate-600">
            Track status and results of your previous tasks.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow>
                <TableHead>Task ID</TableHead>
                <TableHead>File name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Result</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell>{task.id}</TableCell>
                  <TableCell>{task.name}</TableCell>
                  <TableCell>{task.status}</TableCell>
                  <TableCell>{task.result}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete task ${task.id}`}
                      onClick={() => handleDeleteTask(task.id)}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default withAuth(DashboardPage);
