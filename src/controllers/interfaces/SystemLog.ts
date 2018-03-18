export default interface SystemLog {
  event: string;
  subject: string;
  before?: string;
  after: string;
  user_id?: number;
  reference_id?: number;
  table_name?: string
}
