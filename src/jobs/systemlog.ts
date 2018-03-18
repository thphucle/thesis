import writeLog from '../controllers//helpers/log-helper'
import SystemLog from '../controllers/interfaces/SystemLog'
import { schemas } from '../schemas'

let ya: SystemLog = {
  event: 'sdf',
  subject: 'sdf',
  after: 'sdf',
  before: '',
  user_id: 1
};

export = function main() {
  schemas.SystemLog.create(ya);
}
