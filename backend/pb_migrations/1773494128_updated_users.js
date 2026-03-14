/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  // update collection data
  unmarshal({
    "deleteRule": "@request.auth.role = \"admin\"",
    "listRule": "@request.auth.role = \"admin\"",
    "updateRule": "@request.auth.id = id || @request.auth.role = \"admin\"",
    "viewRule": "@request.auth.id != \"\""
  }, collection)

  // add field
  collection.fields.addAt(10, new Field({
    "hidden": false,
    "id": "select1466534506",
    "maxSelect": 1,
    "name": "role",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "member",
      "supervisor",
      "admin"
    ]
  }))

  // add field
  collection.fields.addAt(11, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text1742027165",
    "max": 0,
    "min": 0,
    "name": "house",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(12, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text1923043739",
    "max": 0,
    "min": 0,
    "name": "room",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(13, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text3612849359",
    "max": 0,
    "min": 0,
    "name": "dateOfBirth",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(14, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text2023898971",
    "max": 0,
    "min": 0,
    "name": "membershipStart",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(15, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text1094968492",
    "max": 0,
    "min": 0,
    "name": "membershipEnd",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(16, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text109697690",
    "max": 0,
    "min": 0,
    "name": "avatarInitials",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(17, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text2259320312",
    "max": 0,
    "min": 0,
    "name": "avatarId",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  // update collection data
  unmarshal({
    "deleteRule": "id = @request.auth.id",
    "listRule": "id = @request.auth.id",
    "updateRule": "id = @request.auth.id",
    "viewRule": "id = @request.auth.id"
  }, collection)

  // remove field
  collection.fields.removeById("select1466534506")

  // remove field
  collection.fields.removeById("text1742027165")

  // remove field
  collection.fields.removeById("text1923043739")

  // remove field
  collection.fields.removeById("text3612849359")

  // remove field
  collection.fields.removeById("text2023898971")

  // remove field
  collection.fields.removeById("text1094968492")

  // remove field
  collection.fields.removeById("text109697690")

  // remove field
  collection.fields.removeById("text2259320312")

  return app.save(collection)
})
