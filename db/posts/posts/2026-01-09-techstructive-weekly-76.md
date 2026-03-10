Week #76

It was a good start to the year, finally doing something that I had struggled to do for the past year or so. AI Assisted Programming. Yeah! That was something I finally somewhat understand, and can do it without feeling a slightest of grudge or emotional drama. It took a while to realize it, but here we are. 2026!

I don't know how I feel right now. Its quite a good times to be in tech.

### Quote of the week

> ["If you want to know what a man's like, take a good look at how he treats his inferiors, not his equals."](https://www.goodreads.com/quotes/5399-if-you-want-to-know-what-a-man-s-like-take)
>
> [— Sirius Black](https://www.goodreads.com/quotes/5399-if-you-want-to-know-what-a-man-s-like-take)
>
> ― **J.K. Rowling, [Harry Potter and the Goblet of Fire](https://www.goodreads.com/work/quotes/3046572)**

This is true. I think we should treat people with kindness irrespective of their position. Position is no match for one's love and care for us. They might be doing with their own purpose and needs but they still show it.

---

Created
-------

* [World Atlas Game](https://worldatlas.meetgor.com/)

  + This is vibe coded in a day. Gemini CLI and Amp. Just ripped it
  + I read Golang was good to work with AI Agents, thought of building some backend with it and lo behold, it did one shot it almost. For the frontend I choose Vue. Surprisingly its a great UI. I am honestly impressed. I didn't write a single line of code, let even see.
  + I always wanted to make this, but was very lazy to do all of the meddling with the boilerplatey code, it just did in a few minutes.
* CMS with ssg

  + Yes, this was something I have built twice or thrice, it was another shot. I wanted a blog that can just save to the sqlite db and fetch aas cronjob every 6 hours to build the site with ssg. I just gave it and it did. Its not great, it has still qwirks, but making it better over time.

Read
----

1. [Dialogue between a developer and a kid](https://riggraz.dev/dialogue-developer.html)

   1. This is hilariously funny.
   2. What a real developer is? Who knows languages? No, who knows how to code, No! A developer is someone who sticks to a problem when everyone has given up.
   3. This conversation feels like me and my friend. My friend is the reason I am here today. He knew programming well. I was inspired from him, he gave me advice to learn one programming language, I was boasting about python, C and C++. I feel like a kid here. That was 7 years ago, time flies by.
2. [Fear is not advocacy](https://antonz.org/ai-advocacy/)

   1. This is real advice. People are hyping about the next workflow to 100x our productivity. Its ok to be 1x and still push less bugs than 100x and push 1000 bugs.
3. [Quick and dirty print debuggin in Go](https://alexwlchan.net/2026/q-but-for-go/?ref=rss)

   1. This is cool, we make logging a mess. For logs we need to have separate scripts to get relevant data. How much chaos it can be.
4. [AI Did Not Take Your Agency. You Handed It Over](https://systemic.engineering/ai-did-not-take-your-agency-you-handed-it-over/)

   1. True. LLMs amplify ambguity.
   2. If LLMs don't have agency, they don't choose constraints. Well put.
5. [On not using Django](https://www.natemeyvis.com/on-not-using-django-in-2026/)

   1. I don't quite get it. Maybe its true. Django provided a good start but then it was like a lock in.
   2. With LLMs its quite easy to generate the boilerplatey code that django provides out of the box, so that demand is lost?
   3. Its not the only reason django is here right? It has extensions, best python community and even more best documentation.
   4. I think it will be the best framework to build with LLMs in the future if the ecosystem continues to improve
6. [6'7'' is not Random](https://substack.com/home/post/p-183890370)

   1. This is so true

> In the 1990s, a "middle-class job" was enough to buy a house. Being "6 feet" was enough to be tall.
>
> In the 2020s, the middle has been hollowed out.
>
> To be "wealthy" now requires a crypto-exit or a tech IPO (The Economic 6'7").
>
> To be "famous" requires global virality (The Social 6'7").
>
> To be "attractive" requires filters and surgery (The Aesthetic 6'7").

7. [AI should be free software](https://substack.com/inbox/post/183934559)

   1. Yikes, this looks like a good take on LLMs being free and open weight.
   2. If not, the larger AI labs might offer ads into the LLM suggestions. This, just the thought of it makes me wiggle with fear. It might push us in wired directions.
   3. The point of drawing a line of "our goal" vs "model's goal" becomes hazy and it just doesn't align with human values.
   4. Its a pretty hard problem to solve if it goes in a bad direction, which it seems to be at the moment.

I just completed reading Harry Potter #4 the Goblet of Fire. It was amazing. A good start to 2026 in reading. Hoping to complete the series in February.

Watched
-------

* [Designing Data Intensive Applications: Chapter 1 and 2](https://www.youtube.com/live/G7iU2s7LUzA)

  + It was a great overview of the database systems. I like how he explains the p50, p90, and all metrics. It makes sense without getting into too much of details
  + Also the diagram of the OLAP and OLTP databases and how it fits. It made sense.

* [AI codes better than me, now what?](https://youtu.be/UrNLVip0hSA)

  + This is really changing. It can write code, better than me. That's when I started to use it as a partner that knows a lot of things but gets overwhelmed and like a junior does a lot of things.
  + Guiding it, reviewing it, and also understanding myself what it actually does is co critical.

* [Database Internals:Chapter 1](https://www.youtube.com/live/HibHalGlIes)

  + The difference of the OLAP and OLTP database is so nice.
  + Also the differnce of column based vs row based database type is clear from this. Makes sense and intuitive as well
  + The Binary tree also makes sense.

* [The year I stopped writing code](https://youtu.be/Ge8LoXfJJdA)

  + This is interesting and eye opening. It actually gave me the reason to be active while working with LLMs.
  + Reviewing is hard, most developers avoid it, that's the part you need to be doing, in order to be a better one. That point I had ignored and it has came to haunt me in the year throughout. This new year though, will be different. I have decided to take LLM generated code with a grain of salt.

Learnt
------

1. How to ship code with Cursor

   1. I explained my euphoric moments in the week where I discovered the debug and ask mode in Cursor. It helps me to understand the problem, learn something. Which agent modes doesn't let me.
   2. I can pause and let it show me what is happening, I can read and share with it, what I think and have a conversation and not just make change all the time. The switching mode was liberating, I think these models should know when to ask and when to execute.
2. Read csv from Pandas in python needs quoted string for multiple commas

   1. If you have n headers and have n+m commas in the row, pandas' read csv function will break
   2. Because there is ambiguity in which comma is the header separator and which is the actual text comma.
   3. Use quoted string for the text if it contains comma.

Tech News
---------

* [Tailwind CSS is in trouble due to AI: Help save the open source community thrive for its earnest effort.](https://github.com/tailwindlabs/tailwindcss.com/pull/2388)
* [OpenAI releases ChatGPT health](https://techcrunch.com/2026/01/07/openai-unveils-chatgpt-health-says-230-million-users-ask-about-health-each-week/)

For more news, follow the [Hackernewsletter](https://buttondown.com/hacker-newsletter/archive/777/) ( edition), and for software development/coding articles, join [daily.dev](http://daily.dev/).

That's it, a good start to the year, looking forward to a good and great year 2026, will it be slow? Probably not, but the year seemed to start slow. Looks good for now, we already have a lot of things already to unpack from the last year advancement. 2025 was pivotal for anyone in tech, 2026 onwards it looks like a year to build and carry that momentum.

[Leave a comment](https://www.meetgor.com/newsletter/techstructive-weekly-76/%25%25half_magic_comments_url%25%25)

[Share Techstructive Weekly](https://www.meetgor.com/newsletter/techstructive-weekly-76/%25%25share_pub_url%25%25)

Thanks for reading Techstructive Weekly! Subscribe for free to receive new posts and support my work.
