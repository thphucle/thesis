import {schemas} from '../../schemas'
import SystemLog from  '../interfaces/SystemLog'

async function writeLog(data: SystemLog) {
  await schemas.SystemLog.create(data);
}

export default writeLog;
