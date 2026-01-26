import { io } from "socket.io-client";

const socket = io("http://localhost:3001", {
    query: { type: "client" }
});

socket.on("connect", () => {
    console.log("Client connected!");
    
    // Trigger job after 1 second
    setTimeout(() => {
        console.log("Triggering job...");
        socket.emit("trigger_job", {
            appUrl: "http://example.com/app.zip",
            flowUrl: "http://example.com/flow.yaml"
        });
    }, 1000);
});

socket.on("log_stream", (data) => {
    console.log(`[LOG] ${data.timestamp} - ${data.message.trim()}`);
});

socket.on("job_event", (data) => {
    console.log(`[STATUS] Job ${data.jobId} is now ${data.status}`);
});

socket.on("run_job", (data) => {
    console.log(`[DEBUG] API sent run_job:`, data);
});
