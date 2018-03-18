import { schemas, sequelize } from 'schemas';

module.exports = async () => {
    let userPath = '/1/115/117/';
    let users = await sequelize.query(`
        select id, username, path, created_at from "Users" where id in (
            select user_id from "Tokens" where created_at > '2017-10-01 GMT' and user_id in (
                select id from "Users" WHERE path like '${userPath}%'
            )
        )
    `);
    console.log("users ::", users[0]);
    users = users[0];
    let resultUserArr = [];
    for (let user of users) {
        let path = user.path.substr(userPath.length);
        console.log("path :: ", user.id, path);
        let ids = path.split("/");
        if (ids.length > 7) {
            resultUserArr.push(user);
        }
    }
    console.log("resultUserArr ;:", resultUserArr);
}