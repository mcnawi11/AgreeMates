// Invitation routes
// jshint camelcase: false

'use strict';

var UserModel = require('../models/user').model;
var ApartmentModel = require('../models/apartment').model;
var InvitationModel = require('../models/invitation').model;
var InvitationCollection = require('../models/invitation').collection;
var sendInvitation = require('../controllers/inviteMailer.js');

var invitations = function(app) {

  // Add invitation to database
  app.post('/invitations', function(req, res) {
    if (req.user === undefined || req.body === undefined) {
      res.json(400, {error: 'Missing user or body'});
      return;
    }

    var emails = req.body.emails;
    var apartmentId = req.user.attributes.apartment_id;
    if (apartmentId === null) {
      res.json(404, {error: 'could not fetch id'});
      return;
    }

    new ApartmentModel({id : apartmentId})
      .fetch()
      .then(function(apartment) {
        var apartmentName = apartment.attributes.name;
        var invitations = [];
        for (var i = 0; i < emails.length; i++) {
          invitations[i] = new InvitationModel({
            apartment_id: apartmentId,
            email: emails[i]
          });
        }
        new InvitationCollection(invitations).mapThen(function(model) {
          return model.save().then(function() {
            return {
              id: model.get('id'),
              apartment_id: model.get('apartment_id'),
              email: model.get('email')
            };
          });
        }).then(function(resp) {
          if (resp.length !== invitations.length) {
            res.json(503, {error: 'Error creating invitations'});
          } else {
            resp.forEach(function(invitation) {
              sendInvitation(invitation.id, invitation.email, apartmentName);
            });
            res.json(resp);
          }
        });
      })
      .otherwise(function() {
        res.json(404, {error: 'error getting apartment'});
      });
  });

  // Get invitation information
  app.get('/invitations/:invite', function(req, res) {
    new InvitationModel({id: req.params.invite})
      .fetch()
      .then(function(model) {
        new ApartmentModel({id: model.attributes.apartment_id})
          .fetch()
          .then(function(model2) {
            var user = req.user;
            if (user != null) {
              res.render('components/invitations/index.html', {
                invId: model.attributes.id,
                aptName: model2.attributes.name,
                aptAddress: model2.attributes.address
              });
            } else {
              res.render('components/invitations/login.html', {
                invId: model.attributes.id
              });
            }
          })
          .otherwise(function(error) {
            console.log(error);
            res.json(404, {error: 'failed to fetch apartment'});
          });
      })
      .otherwise(function(error) {
        console.log(error);
        res.json(404, {error: 'error getting invitation'});
      });

  });


  // Removes invitation from the database
  app.delete('/invitations/:invite', function(req, res) {
    new InvitationModel({id: req.params.invite})
      .fetch()
      .then(function(model) {
        new UserModel({id: req.user.id})
          .save({apartment_id: model.attributes.apartment_id}, {path: true})
          .then(function() {
            new InvitationModel({id: req.params.invite})
            .destroy()
            .then(function() {
              res.send(200);
            })
            .otherwise(function() {
              res.json(503, {error: 'failed to destroy invitation'});
            });
          })
          .otherwise(function() {
            res.json(503, {error: 'failed to add user to apartment'});
          });
      })
      .otherwise(function() {
        res.json(503, {error: 'failed to get invitation'});
      });
  });

};

module.exports = invitations;
