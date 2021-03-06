"use strict";

const postbackActions = require("./messageTypes/postback");
const messageActions = require("./messageTypes/message");
const Bluebird = require("bluebird");
const Users = require("../models/users.model");
const { TextMessage } = require("../platforms/generics");
const translator = require("../utils/translator");
const logger = require("../providers/logging/logger");

module.exports = () => ({
  ask (type, senderId, message, intent, entities, res, locale) {
    Users.where({ senderId }).update({ $inc: { messageNumber: 1 } }).exec();

    switch (type) {
    case "postback": {
      let promise;

      postbackActions.some((postback) => {
        if (message.match(new RegExp(postback.regx))) {
          promise = postback.action(senderId, message, postback.regx, entities, res, locale);
          return true;
        }
        return false;
      });

      return promise.catch((err) => isDisconnected(err, locale));
    }
    case "message": {
      if (!messageActions[intent] || !messageActions[intent].action) {
        return Bluebird.resolve({ responses: [new TextMessage(translator("noAnswer", locale))], feedback: false });
      }

      return messageActions[intent].action(senderId, message, entities, res, locale).catch((err) => isDisconnected(err, locale));
    }
    default:
      return null;
    }
  }
});

function isDisconnected (err, locale) {
  let error;
  if (err.statusCode === 403 || err.statusCode === 401) {
    error = Object.assign({}, err, { message: translator("disconnected", locale) });
  } else {
    logger.error(err);
    error = err;
  }

  return Bluebird.reject(error);
}
