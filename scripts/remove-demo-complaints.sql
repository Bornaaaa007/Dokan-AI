-- Removes the demo complaints and the demo orders they belong to.
-- Deleting an order also deletes its complaints.
delete from orders
where id in (select order_id from complaints where description like '[DEMO]%');

select count(*) as demo_complaints_left from complaints where description like '[DEMO]%';
