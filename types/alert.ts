export type AlertStatus = "active" | "completed" | "no_response" | "in_progress";

export type StepStatus = "success" | "error" | "pending";

export type TimelineStep = {
  label: string;
  detail: string;
  status: StepStatus;
};

export type Alert = {
  id: string;
  title: string;
  houseName: string;
  description: string;
  location: string;
  time: string;
  date: string;
  status: AlertStatus;
  countdown?: number;
  answeredBy?: string;
  timeline: TimelineStep[];
};

export type SystemAlert = {
  id: string;
  deviceId: string;
  title: string;
  deviceName: string;
  houseName: string;
};
