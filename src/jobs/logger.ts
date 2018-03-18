import {Logger, LogType} from "../libs/logger";

module.exports = () => {
  var logger = new Logger();
  var obj = {
    "keke": "keke",
    "hihi": "hihi"
  };
  logger.log(obj);
}
