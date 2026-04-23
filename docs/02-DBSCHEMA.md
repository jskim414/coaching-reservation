## services

- id (PK)
- type (coaching, workshop)
- name
- description
- duration_min
- price
- capacity_default
- is_active

---

## slots

- id (PK)
- service_id (FK)
- start_at
- end_at
- capacity
- reserved_count
- is_open

---

## bookings

- id (PK)
- service_id (FK)
- slot_id (FK)
- name
- email
- phone
- organization
- note
- status
- applied_at
- confirmed_at

---

## admins

- id (PK)
- google_email

---

## message_logs

- id (PK)
- booking_id
- channel
- template_type
- sent_at
- status
