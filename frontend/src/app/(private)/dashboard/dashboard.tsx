"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
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
import { getTaskStatus, getTasks, transcribeFile, TaskStatus } from "@/lib/api";
import { useReactMediaRecorder } from "react-media-recorder";

interface Task {
  id: string;
  name: string;
  status: TaskStatus;
  result: string;
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

function DashboardPage() {
  const [file, setFile] = useState<File | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const { status, startRecording, stopRecording, mediaBlobUrl } =
    useReactMediaRecorder({ audio: true });

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      return;
    }

    const storedNames = readStoredTaskNames();

    const loadTasks = async () => {
      try {
        const response = await getTasks(token);
        setTasks(
          response.data.map((task) => ({
            id: task.id,
            name: storedNames[task.id] || task.id,
            status: task.status,
            result: task.result || "",
          }))
        );
      } catch (error) {
        console.error("Error fetching tasks:", error);
      }
    };

    loadTasks();
  }, []);

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
                prevTasks.map((t) =>
                  t.id === updatedTask.id
                    ? {
                        ...t,
                        status: updatedTask.status,
                        result: updatedTask.result || "",
                      }
                    : t
                )
              );
            } catch (error) {
              console.error(`Error fetching status for task ${task.id}:`, error);
            }
          }
        });
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [tasks]);

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
        };
        rememberTaskName(newTask.id, newTask.name);
        setTasks((prevTasks) => [...prevTasks, newTask]);
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
    if (mediaBlobUrl) {
      const audioBlob = await fetch(mediaBlobUrl).then((r) => r.blob());
      const audioFile = new File([audioBlob], "recorded_audio.wav", {
        type: "audio/wav",
      });
      uploadFile(audioFile);
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="upload">
        <TabsList>
          <TabsTrigger value="upload">Upload File</TabsTrigger>
          <TabsTrigger value="record">Record Voice</TabsTrigger>
        </TabsList>
        <TabsContent value="upload">
          <Card>
            <CardHeader>
              <CardTitle>Upload an audio file</CardTitle>
              <CardDescription>
                Select an audio file from your computer to transcribe.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input type="file" onChange={handleFileChange} />
              <Button onClick={handleUpload}>Upload and Transcribe</Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="record">
          <Card>
            <CardHeader>
              <CardTitle>Record your voice</CardTitle>
              <CardDescription>
                Click the button to start/stop recording.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>Status: {status}</p>
              <Button onClick={startRecording}>Start Recording</Button>
              <Button onClick={stopRecording}>Stop Recording</Button>
              <Button onClick={handleRecordedAudio} disabled={!mediaBlobUrl}>
                Upload Recording
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Transcription History</CardTitle>
          <CardDescription>
            View the status and results of your previous transcriptions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task ID</TableHead>
                <TableHead>File Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell>{task.id}</TableCell>
                  <TableCell>{task.name}</TableCell>
                  <TableCell>{task.status}</TableCell>
                  <TableCell>{task.result}</TableCell>
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
