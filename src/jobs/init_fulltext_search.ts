import {schemas, sequelize} from "../schemas";

export = function main() {
  sequelize.sync({force: true}).then(async (rs) => {
    Object.keys(schemas).forEach((modelName: string) => {
      if (typeof schemas[modelName].addFullTextIndex === "function") {
        this.schemas[modelName].addFullTextIndex();
      }
    });
  });
}
