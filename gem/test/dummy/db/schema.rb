# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `rails
# db:schema:load`. When creating a new database, `rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema.define(version: 2020_08_01_005003) do

  create_table "collab_commits", id: false, force: :cascade do |t|
    t.integer "document_id", null: false
    t.integer "document_version", null: false
    t.json "steps", null: false
    t.string "ref"
    t.datetime "created_at", null: false
    t.index ["document_id", "document_version"], name: "index_collab_commits", unique: true
  end

  create_table "collab_documents", force: :cascade do |t|
    t.string "attached_type", null: false
    t.integer "attached_id", null: false
    t.string "attached_as", null: false
    t.json "content", null: false
    t.string "schema_name", null: false
    t.integer "document_version", default: 0, null: false
    t.text "serialized_html"
    t.datetime "created_at", precision: 6, null: false
    t.datetime "updated_at", precision: 6, null: false
    t.index ["attached_type", "attached_id", "attached_as"], name: "index_collab_documents_on_attached"
  end

  create_table "notes", force: :cascade do |t|
    t.datetime "created_at", precision: 6, null: false
    t.datetime "updated_at", precision: 6, null: false
  end

  add_foreign_key "collab_commits", "collab_documents", column: "document_id"
end
