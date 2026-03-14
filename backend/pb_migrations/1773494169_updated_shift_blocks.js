/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_363676523")

  // update field
  collection.fields.addAt(1, new Field({
    "hidden": false,
    "id": "number2959594093",
    "max": null,
    "min": null,
    "name": "dayOfWeek",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_363676523")

  // update field
  collection.fields.addAt(1, new Field({
    "hidden": false,
    "id": "number2959594093",
    "max": null,
    "min": null,
    "name": "dayOfWeek",
    "onlyInt": false,
    "presentable": false,
    "required": true,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
})
