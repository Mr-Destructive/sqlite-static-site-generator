# My Favorite Postgres 18 feature: Virtual generated columns

**Link:** https://tselai.com/virtual-gencolumns

## Context

: I agree to this, there are pros and cons of both. Stored makes write heavier but are read efficient. Virtual makes it write easier and read heavier. You have trade-offs, you need to decide based on the computation that impacts how you want the column to be generated. I don’t like the notion of JSON flattening in Postgres. Postgres is not a database that would be ideal for that kind of data. I know there are tons and tons of support for JSON, but tables and JSON, I can’t bare it at once. Those two are just separate entities for me. Maybe they are useful in one-off values, not not much. Switch to NoSQL if you have that lengthy data.

**Source:** techstructive-weekly-60
