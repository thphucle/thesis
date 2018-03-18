const PROCESSING_USERS:any = {};

function isProcessing(user_id: number) {
  return !!PROCESSING_USERS[user_id];
}

function unlockUserProcessing(user_id: number) {
  delete PROCESSING_USERS[user_id];
}

function lockUserProcessing(user_id: number) {
  PROCESSING_USERS[user_id] = true;
};

export default {
  isProcessing,
  unlockUserProcessing,
  lockUserProcessing
}