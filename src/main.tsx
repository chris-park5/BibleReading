
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './queryClient';
import App from "./app/App.tsx";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);
  