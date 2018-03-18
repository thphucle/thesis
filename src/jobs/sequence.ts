import {schemas, sequelize} from "../schemas";

export = async function main() {
  for (let table in sequelize.models) {
    try {
      let ignoreTables = ['TelegramPhone'];
      if (ignoreTables.indexOf(table) != -1) continue;
      if (!schemas[table]) continue;
      let record = await schemas[table].findAll({
        limit: 1,
        order: [ [ 'id', 'DESC' ]],
        attributes: ['id']
      });

      if (record && record.count()) {
        let item = record[0].toJSON();
        let sequence = parseInt(item.id) + 1;
        console.log("sequence :: ", table, sequence);
        await sequelize.query(`ALTER SEQUENCE "${schemas[table].tableName}_id_seq" RESTART WITH ${sequence}`);
      }
    } catch (e) {
      console.log("Not Found Table :: ", table);
      console.error(e.stack);
    }
  }
}
