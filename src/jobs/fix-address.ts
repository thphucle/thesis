const Users = require('./Users.json').RECORDS;
const fs = require('fs');
const path = require('path');

function makeCurrent() {
  let hash = {};
  let maxId = 0;
  for (let u of Users) {
    let userId = parseInt(u.id);
    maxId = maxId < userId ? userId : maxId;
    hash[userId] = u.bdl_address;
  }

  let output = [];
  for (let i = 0; i <= maxId; i++) {
    let address = hash[i];
    if (!address) {
      address = 'N/A';
    }
    output.push(address);
  }
  console.log('maxId', maxId);
  let currentPath = path.join(__dirname, '..', 'current.json');
  console.log('currentPath', currentPath);
  fs.writeFileSync(
    currentPath,
    JSON.stringify(output, null, 2)
  );
}

function appendNewAddresses() {
  let newAddressPath = path.join(__dirname, '..', '..', 'new-address.txt');
  let newAddressList = fs.readFileSync(newAddressPath).toString();
  newAddressList = newAddressList.split('\n').filter(s => s.length > 0);

  let mixedPath = path.join(__dirname, '..', 'mixed.json');
  let mixedList = require(mixedPath);
  console.log('old length:', mixedList.length);
  for (let add of newAddressList) {
    if (mixedList.indexOf(add) == -1) {
      mixedList.push(add);
    } else {
      console.log(`${add} was found at ${mixedList.indexOf(add)}`);
    }
  }
  console.log('mixedList.length', mixedList.length);
  console.log('Re test');
  for(let i = 1; i < mixedList.length; i++) {
    for (let j = 0; j < i; j++) {
      if (mixedList[i] == mixedList[j]) {
        console.log(`Duplicate ${i}, ${j}, ${mixedList[j]}`);
      }
    }
  }


  let finalPath = path.join(__dirname, '..', 'finalAddress.json');
  fs.writeFileSync(
    finalPath,
    JSON.stringify(mixedList, null, 2)
  );
}

module.exports = async () => {
  console.log('start');
  try {
    // makeCurrent();
    // createMixed();
    // appendNewAddresses();
/*    testCompatible();*/


  } catch (error) {
    console.error(error);
  }
}
