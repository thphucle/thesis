
const fs = require('fs');
const path = require('path');
const dumpPath = path.join(__dirname,'..', '..', 'dump');

export = () => {
  const source = path.join(dumpPath, getLastestFolder(), 'MobileTransaction.json');

  const data = require(source);
  let rs = [];
  for (let row of data) {
    row.usd = 50;
    delete row['bdl'];
    delete row['rate_bdl_usd'];

    rs.push(row);
  }

  console.log(rs.length);
  fs.writeFileSync(source, JSON.stringify(rs, null, 2));
  console.log("DONE");
}

function getLastestFolder() {
  let folders = fs.readdirSync(dumpPath)
  .filter(file => fs.lstatSync(path.join(dumpPath, file)).isDirectory())
  .sort((a, b) => b > a);
  return folders[0];
}
