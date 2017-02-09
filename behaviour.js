// @flow
import { check, Match } from 'meteor/check';
import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import SoftRemoveError from './error';

const defaults = {
  removed: 'removed',
  removedAt: 'removedAt',
  removedBy: 'removedBy',
  restoredAt: 'restoredAt',
  restoredBy: 'restoredBy',
  systemId: '0',
};

const symbol = Symbol('collectionbehaviours:softremove');

export default function behaviour(argument = {}) {
  if (Match.test(argument, Mongo.Collection)) {
    argument = {
      collection: argument,
    };
  }

  const { collection, options = {} } = argument;

  check(collection, Mongo.Collection);
  check(options, Object);

  if (collection[symbol]) {
    const message = 'The softremove behaviour has already been added to this collection.';
    throw new SoftRemoveError(message);
  }

  const {
    removed,
    removedAt,
    removedBy,
    restoredAt,
    restoredBy,
    systemId,
  } = {
    ...defaults,
    ...options,
  };

  check(removed, String);
  check(removedAt, String);
  check(removedBy, String);
  check(restoredAt, String);
  check(restoredBy, String);
  check(systemId, String);

  // eslint-disable-next-line no-shadow
  function beforeFindHook(userId = systemId, selector, options = {}) {
    if (!selector) {
      return;
    } else if (Match.test(selector, String)) {
      selector = {
        _id: selector,
      };

      // This is needed because we've reassigned selector
      this.args[0] = selector;
    }

    if (!options[removed] && selector[removed] == null) {
      selector[removed] = {
        $exists: false,
      };
    }
  }

  const beforeFindHandle = collection.before.find(beforeFindHook);
  const beforeFindOneHandle = collection.before.findOne(beforeFindHook);

  function beforeUpdateHook(userId = systemId, doc, fieldNames, modifier) {
    const $set = modifier.$set != null ? modifier.$set : modifier.$set = {};
    const $unset = modifier.$unset != null ? modifier.$unset : modifier.$unset = {};

    // Don't soft remove if already soft removed
    if ($set[removed] && doc[removed]) {
      return false;
    }

    // Don't restore if not soft removed
    if ($unset[removed] && !doc[removed]) {
      return false;
    }

    // Soft remove if not soft removed
    if ($set[removed] && !doc[removed]) {
      $set[removed] = true;

      if (removedAt) {
        $set[removedAt] = new Date();
      }

      if (removedBy) {
        $set[removedBy] = userId;
      }

      if (restoredAt) {
        $unset[restoredAt] = true;
      }

      if (restoredBy) {
        $unset[restoredBy] = true;
      }
    }

    // Restore if soft removed
    if ($unset[removed] && doc[removed]) {
      $unset[removed] = true;

      if (removedAt) {
        $unset[removedAt] = true;
      }

      if (removedBy) {
        $unset[removedBy] = true;
      }

      if (restoredAt) {
        $set[restoredAt] = new Date();
      }

      if (restoredBy) {
        $set[restoredBy] = userId;
      }
    }

    // Remove $set if it's an empty object
    if (Object.keys($set).length === 0 && $set.constructor === Object) {
      delete modifier.$set;
    }

    // Remove $unset if it's an empty object
    if (Object.keys($unset).length === 0 && $unset.constructor === Object) {
      delete modifier.$unset;
    }

    return undefined;
  }

  const beforeUpdateHandle = collection.before.update(beforeUpdateHook);

  // eslint-disable-next-line no-underscore-dangle
  const isLocalCollection = collection._connection === null;

  collection.softRemove = function softRemove(selector, callback) {
    if (!selector) {
      return 0;
    }

    const $set = {};
    const modifier = {
      $set,
    };

    $set[removed] = true;

    let affectedDocuments = 0;

    try {
      if (Meteor.isServer || isLocalCollection) {
        affectedDocuments = this.update(selector, modifier, { multi: true }, callback);
      } else {
        affectedDocuments = this.update(selector, modifier, callback);
      }
    } catch (error) {
      if (error.reason.includes('Not permitted.')) {
        const message = 'Not permitted. Untrusted code may only remove documents by ID.';
        throw new Meteor.Error(403, message);
      }
    }

    if (affectedDocuments === false) {
      return 0;
    }

    return affectedDocuments;
  };

  collection[symbol] = true;

  const handle = {
    remove() {
      beforeFindHandle.remove();
      beforeFindOneHandle.remove();
      beforeUpdateHandle.remove();
      delete collection.softRemove;
      delete collection[symbol];
    },
  };

  return handle;
}
