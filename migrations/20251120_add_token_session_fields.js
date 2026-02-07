'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Users', 'currentToken', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn('Users', 'tokenIssuedAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('Users', 'tokenExpiresAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('Users', 'isTokenActive', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    });

    console.log('✅ Migration: Added token session fields to Users table');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Users', 'currentToken');
    await queryInterface.removeColumn('Users', 'tokenIssuedAt');
    await queryInterface.removeColumn('Users', 'tokenExpiresAt');
    await queryInterface.removeColumn('Users', 'isTokenActive');

    console.log('✅ Migration: Removed token session fields from Users table');
  }
};
