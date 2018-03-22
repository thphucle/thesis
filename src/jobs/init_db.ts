import {schemas, sequelize} from "../schemas";
import misc from "libs/misc";

export = function main() {
  sequelize.sync({force: true}).then(async (rs) => {
    let admin1 = await schemas.User.create({
      "avatar": "",
      "email": "fake01@contractium.io",
      "fullname": "zen zen",
      "username": "zenzen",
      "national": "1",
      "nid": "123456781",
      "otp_secret": "KM4CU6LXI4WHQZDBKBLWEVZQMVJFIT2XKNRS6UJ4M54UCPSD",
      "password": misc.sha256("123"),
      "password2": misc.sha256("123"),
      "phone": "+84900000001",
      "role": "user",
      "salt": "b60cd02a214ee1d63b09da257d6a35a98558ad95",
      "signed_in_time": new Date(),
      "status": "active",
      "path": "/1/2/",
      "bdl_address": "GeA7XGxiBMLVyn33udfLipjZqYdahtHBHu",
      "created_at": new Date(),
      "updated_at": new Date()
    });

    let admin2 = await schemas.User.create({
      "avatar": "",
      "email": "fake02@contractium.io",
      "fullname": "admin",
      "username": "admin",
      "national": "1",
      "nid": "123456781",
      "otp_secret": "KM4CU6LXI4WHQZDBKBLWEVZQMVJFIT2XKNRS6UJ4M54UCPSD",
      "password": misc.sha256("sTNE#Zs2j_5rRr5w"),
      "password2": misc.sha256("sTNE#Zs2j_5rRr5w"),
      "phone": "+84900000002",
      "receive_address": "39mSdm2adc3BZK17SfbfKQyJ4bhHUKhHS3",
      "role": "admin",
      "salt": "b60cd02a214ee1d63b09da257d6a35a98558ad95",
      "signed_in_time": new Date(),
      "status": "active",
      "path": "/1/3/",
      "bdl_address": "GUmJn5QNzFKcrBNC6wDx82cMmywhLtioDa",
      "created_at": new Date(),
      "updated_at": new Date()
    });
  });
}
