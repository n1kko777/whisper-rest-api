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
import { getTaskStatus, transcribeFile } from "@/lib/api";
import { useReactMediaRecorder } from "react-media-recorder";

interface Task {
  id: number;
  name: string;
  status: string;
  result: string;
}

function DashboardPage() {
  const [file, setFile] = useState<File | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const { status, startRecording, stopRecording, mediaBlobUrl } =
    useReactMediaRecorder({ audio: true });

  useEffect(() => {
    const interval = setInterval(() => {
      const token = localStorage.getItem("token");
      if (token) {
        tasks.forEach(async (task) => {
          if (task.status === "pending" || task.status === "processing") {
            try {
              const response = await getTaskStatus(task.id, token);
              const updatedTask = response.data;
              setTasks((prevTasks) =>
                prevTasks.map((t) =>
                  t.id === updatedTask.id
                    ? { ...t, status: updatedTask.status, result: updatedTask.result }
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
          status: "pending",
          result: "",
        };
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