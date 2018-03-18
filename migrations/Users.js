'use strict';
  module.exports = {
    up: function(queryInterface, Sequelize) {
      return queryInterface.addColumn(
        'Users',
        'gender', Sequelize.STRING);
    },
    down: function(queryInterface, Sequelize) {
      return queryInterface.dropTable(Users);
    }
  };
