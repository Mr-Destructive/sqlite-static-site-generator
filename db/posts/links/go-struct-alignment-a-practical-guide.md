# Go Struct Alignment: A Practical Guide

**Link:** https://medium.com/@Realblank/go-struct-alignment-a-practical-guide-e725c8e1d14e

## Context

I have read this and it makes sense, a bit wired but nice. Writing structs should be carefully planned, so just add the largest ones at the top and cram all the smaller ones thereafter. The rule of thumb to follow if you have any memory-heavy or scarce use case. Handy functions like Sizeof, Alignof, Offsetof are used to get the total byte size, memory alignment requirement, the field start position of the struct or any fields. Use it to craft the proper and perfect structure by tinkering and aligning.

**Source:** techstructive-weekly-60
