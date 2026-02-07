'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'occTokenBalance', {
      type: Sequelize.BIGINT,
      allowNull: true,
      defaultValue: 0,
    });

    console.log('✅ Migration: Added occTokenBalance column to users table');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('users', 'occTokenBalance');

    console.log('✅ Migration: Removed occTokenBalance column from users table');
  }
};
