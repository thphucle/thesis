'use strict';

import * as SequelizeStatic from "sequelize";
import {Sequelize} from "sequelize";
import * as config from "../libs/config";
import * as eventEmitter from "../events/event_emitter";


var fs = require('fs');
var path = require('path');

class Database {
  private _basename: string;
  private schemas: any;
  private _sequelize: Sequelize;

  constructor() {
    this._basename = path.basename(module.filename);

    let dbConfig = config.database;
    this._sequelize = new SequelizeStatic(dbConfig.database, dbConfig.username,
      dbConfig.password, dbConfig);
    this.schemas = ({} as any);

    fs.readdirSync(__dirname).filter((file: string) => {
      return (file !== this._basename) && (file !== "interfaces") && (file != "hooks") && path.extname(file) != ".map";
    }).forEach((file: string) => {
      let model = this._sequelize.import(path.join(__dirname, file));
      this.schemas[(model as any).name] = model;
    });

    Object.keys(this.schemas).forEach((modelName: string) => {
      if (typeof this.schemas[modelName].associate === "function") {
        this.schemas[modelName].associate(this.schemas);
      }
    });

    fs.readdirSync(path.join(__dirname, "hooks")).filter((file: string) => {
      return path.extname(file) != ".map";
    }).forEach((file: string) => {
      var hook = require(path.join(__dirname, "hooks", file));
      hook(this.schemas, eventEmitter);
    });

    this.schemas['sequelize'] = this._sequelize;
  }

  getModels() {
    return this.schemas;
  }

  getSequelize() {
    return this._sequelize;
  }
}


const database = new Database();
export const schemas = database.getModels();
export const sequelize = database.getSequelize();
