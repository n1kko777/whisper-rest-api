import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Home() {
  return (
    <Card className="w-[400px]">
      <CardHeader>
        <CardTitle>Welcome to Whisper REST API</CardTitle>
        <CardDescription>
          A simple and powerful API for audio transcription.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p>
          You can use this service to transcribe your audio files.
        </p>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Link href="/login" passHref>
          <Button>Login</Button>
        </Link>
        <Link href="/register" passHref>
          <Button variant="outline">Register</Button>
        </Link>
      </CardFooter>
    </Card>
  );
}