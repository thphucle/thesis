/**
 * migration 18/09/2017
 */

import {schemas} from "schemas";

module.exports = async () => {
  try {
    let lastCronjob = new Date();
    lastCronjob.setDate(lastCronjob.getDate() - 1);

    await schemas.Meta.create({
      key: 'last_cronjob',
      value: lastCronjob.toString()
    });

    await schemas.Meta.create({
      key: 'cronjob_count',
      value: '-1'
    });


  } catch (error) {
    console.error(error);
  }
};