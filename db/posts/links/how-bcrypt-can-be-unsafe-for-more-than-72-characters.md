# How bcrypt can be unsafe for more than 72 characters

**Link:** https://blog.enamya.me/posts/bcrypt-limitation

## Context

Oh, that is wired, use Argon guys, if you aren’t just storing passwords. Nice to know that bcrypt is not safe for passwords greater than 72 characters, who would even store such a long password? But that is the thing, subtle decisions, like this is not a password, so we can use bcrypt, and bam, you would be wrong

**Source:** techstructive-weekly-69
