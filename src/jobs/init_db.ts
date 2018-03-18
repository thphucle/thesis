import {schemas, sequelize} from "../schemas";
import misc from "libs/misc";

export = function main() {
  sequelize.sync({force: true}).then(async (rs) => {
    let boss = await schemas.User.create({
      "avatar": "",      
      "email": "boss@bitdeal.co",
      "fullname": "The Boss",
      "username": "boss",
      "national": "1",
      "nid": "123456781",
      "otp_secret": "KM4CU6LXI4WHQZDBKBLWEVZQMVJFIT2XKNRS6UJ4M54UCPSD",
      "password": misc.sha256("123"),
      "password2": misc.sha256("123"),
      "phone": "+8490000000",      
      "role": "user",
      "salt": "b60cd02a214ee1d63b09da257d6a35a98558ad95",
      "signed_in_time": new Date(),
      "status": "active",
      "path": "/1/",
      "bdl_address": "GdB6gsBnfCuquHEtQrPHQGVwBCWMf2QzjW",      
      "created_at": new Date(),
      "updated_at": new Date()
    });

    // console.log('boss');
    // console.log(boss);
    // boss = boss.toJSON();

    let admin1 = await schemas.User.create({
      "avatar": "",
      "email": "fake01@bitdeal.co",
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
      "referral_id": boss.id,
      "parent_id": boss.id,      
      "created_at": new Date(),
      "updated_at": new Date()
    });

    let admin2 = await schemas.User.create({
      "avatar": "",
      "email": "fake02@bitdeal.co",
      "fullname": "admin",
      "username": "admin",
      "national": "1",
      "nid": "123456781",
      "otp_secret": "KM4CU6LXI4WHQZDBKBLWEVZQMVJFIT2XKNRS6UJ4M54UCPSD",
      "password": misc.sha256("123"),
      "password2": misc.sha256("123"),
      "phone": "+84900000002",
      "receive_address": "39mSdm2adc3BZK17SfbfKQyJ4bhHUKhHS3",
      "role": "admin",
      "salt": "b60cd02a214ee1d63b09da257d6a35a98558ad95",
      "signed_in_time": new Date(),
      "status": "active",
      "path": "/1/3/",
      "bdl_address": "GUmJn5QNzFKcrBNC6wDx82cMmywhLtioDa",
      "referral_id": boss.id,
      "parent_id": boss.id,      
      "created_at": new Date(),
      "updated_at": new Date()
    });

    await boss.update({
      left_id: admin1.id,
      right_id: admin2.id
    });

    // let user4 = await schemas.User.create({
    //   "avatar": "",
    //   "email": "fakeuser4@bitdeal.co",
    //   "fullname": "user4",
    //   "username": "user4",
    //   "national": "1",
    //   "nid": "+84",
    //   "otp_secret": "KM4CU6LXI4WHQZDBKBLWEVZQMVJFIT2XKNRS6UJ4M54UCPSD",
    //   "password": misc.sha256("123321"),
    //   "password2": misc.sha256("123321"),
    //   "phone": "+84900000004",
    //   "role": "user",
    //   "salt": "b60cd02a214ee1d63b09da257d6a35a98558ad95",
    //   "signed_in_time": new Date(),
    //   "status": "active",
    //   "path": "/1/2/4/",
    //   "bdl_address": "GXnHiPBW6s1R6q4wEeUUW3dkCbDG517nMv",
    //   "created_at": new Date(),
    //   "updated_at": new Date(),
    //   "referral_id": admin1.id,
    //   "parent_id": admin1.id
    // });
    
    // await admin1.setLeft(user4);

    // meta

    await schemas.Meta.create({
      key: 'bdl_usd',
      value: 0.294595
    });

    await schemas.Meta.create({
      key: 'bdl_btc',
      value: 0.00013089
    });

    await schemas.Meta.create({
      key: 'btc_usd',
      value: 2283.88
    });

    await schemas.Meta.create({
      key: 'bonus_rate',
      value: 0.5
    });

    await schemas.Meta.create({
      key: 'last_cronjob',
      value: '2017-12-22 GMT+00:00'
    });

    await schemas.Meta.create({
      key: 'ico_start_time',
      value: '2017-12-22 GMT+00:00'
    });

    await schemas.Meta.create({
      key: 'ico_end_time',
      value: '2017-12-22 GMT+00:00'
    });

    await schemas.Meta.create({
      key: 'btc_usd_system',
      value: '13000'
    });

    await schemas.Meta.create({
      key: 'bdl_usd_system',
      value: '0.12'
    });

    await schemas.Meta.create({
      key: 'bounty',
      value: '50'
    });

    await schemas.Meta.create({
      key: 'referral',
      value: '0.05'
    });
  });
}
