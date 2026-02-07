'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert('plans', [
      {
        months: 3,
        price: 99.99,
        status: 'ACTIVE'
      },
      {
        months: 6,
        price: 179.99,
        status: 'ACTIVE'
      },
      {
        months: 9,
        price: 249.99,
        status: 'ACTIVE'
      },
      {
        months: 12,
        price: 299.99,
        status: 'ACTIVE'
      }
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('plans', null, {});
  }
};
