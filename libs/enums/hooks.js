const READ_REAL = {
    order: -100
  },
  READ_ALL = {
    order: -100,
    filter: {
      fake: null
    }
  },
  MODIFY_INTERNAL_FAKE = {
    order: -10,
    filter: {
      fake: true
    }
  },
  MODIFY_INTERNAL_REAL = {
    order: -10
  },
  MODIFY_INTERNAL_ALL = {
    order: -10,
    filter: {
      fake: null
    }
  },
  MODIFY_REAL = {
    order: -5
  },
  MODIFY_ALL = {
    order: -5,
    filter: {
      fake: null
    }
  },
  MODIFY_FAKE = {
    order: -5,
    filter: {
      fake: true
    }
  },
  READ_DESTINATION_REAL_CLASS = {
    order: 95
  },
  READ_DESTINATION_ALL_CLASS = {
    order: 95,
    filter: {
      fake: null
    }
  },
  READ_DESTINATION_FAKE_CLASS = {
    order: 100,
    filter: {
      fake: true
    }
  },
  READ_DESTINATION_REAL = {
    order: 100
  },
  READ_DESTINATION_ALL = {
    order: 100,
    filter: {
      fake: null
    }
  },
  READ_DESTINATION_FAKE = {
    order: 100,
    filter: {
      fake: true
    }
  };
module.exports = {
  READ_REAL: READ_REAL,
  READ_ALL: READ_ALL,
  MODIFY_INTERNAL_FAKE: MODIFY_INTERNAL_FAKE,
  MODIFY_INTERNAL_REAL: MODIFY_INTERNAL_REAL,
  MODIFY_INTERNAL_ALL: MODIFY_INTERNAL_ALL,
  MODIFY_REAL: MODIFY_REAL,
  MODIFY_ALL: MODIFY_ALL,
  MODIFY_FAKE: MODIFY_FAKE,
  READ_DESTINATION_REAL_CLASS: READ_DESTINATION_REAL_CLASS,
  READ_DESTINATION_ALL_CLASS: READ_DESTINATION_ALL_CLASS,
  READ_DESTINATION_FAKE_CLASS: READ_DESTINATION_FAKE_CLASS,
  READ_DESTINATION_REAL: READ_DESTINATION_REAL,
  READ_DESTINATION_ALL: READ_DESTINATION_ALL,
  READ_DESTINATION_FAKE: READ_DESTINATION_FAKE
};
