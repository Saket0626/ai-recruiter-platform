export type SendRequest = {
  recipient: string;
  subject: string;
  body: string;
  resumePath: string;
};

export type SendResult = {
  ok: boolean;
  dryRun: boolean;
  graphStatus: string | null;
  error?: string;
};

export interface EmailProvider {
  sendResearchEmail(request: SendRequest): Promise<SendResult>;
}
