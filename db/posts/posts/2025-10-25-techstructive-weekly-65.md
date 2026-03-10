## Week #65
A happy gloom Diwali, gone in a woosh. We are in a different year. 2082 Vikram Samvat, If you are into that. Felt a bit sad, a bit happy. Not sure what the next year might have in offer. Hopefully it would be for the good.

Compared to last tear, I find myself happier, but lost at the same time. I have found a cure to my writing slump atlast and trying to wrestle a writing routine. It looks a bit promising, 2 months to end 2025, still a comeback on the edge. This year was wild, I had severe anxiety and it kept throwing AI LLM Models every day, all day. Each day felt like waking up from existential crisis, but here I am writing it, the sixty fifth edition. More to come.

This week as expected was Diwali. A celebration of lighting up lifes, not just diyas and lamps. In the hope of finding a book revolving and giving a vine of Diwali, I am projected towards writing one myself, because it doesn’t exist. Mumbai, middle class, childhood nostalgia, mid semester vacation, crackers, New year wishes, cleaning of home and shops, lighting up the atmosphere, no book covers those. I am excited to be write that book, but not now, I will focus kn finishing the project at hand. Finishing is a skill I lack quite a lot, I want to start my writing career on a good note. So, expect a complete novel by the end of the year. Atleast the first draft.

Back to tech, I vibed a lot, cursor agent is my new thing at work. I am mostly delegating the heavy lifting from it, so that I can do the actual stuff. I also started using amp code which is free now, on my phone, just a way to explore new repositories or just implement a random side project in middle of day, its pretty cool, its UI is mobile friendly which surprised me. Really looking forward to writing about the experience and the feeling of working with ai code assistant in the terminal.

### Quote of the week
“To understand is to stand under which is to look up to which is a good way to understand”

— Corita Kent

Understand, the key thing in todays  AI world is so important. You have to have a good depth, a keen sense of ants eye view, not birds eye view, you literally have to dig things up. AI is there to do the general, surface level digging, anyone can do that, but that doesn't build competence and trust. Understanding does, it could be a concept, a document, codebase, tools, blog anything, someone is expecting it from you, don’t be the same slop as LLM, don’t listen to Richard Button in this case,try to distinguish your efforts from others.

## Read
[You cannot outsource understanding](https://russmiles.substack.com/p/you-cannot-outsource-understanding)- So true, this is relief bringer post. People tried replacing developers so many times, yet here we are. Cleaning the vibe coded slop

- We had assembly to programming language to no-code platforms, and now AI. They all wanted to outsource the burden of managing or working with developers but eventually they end up in more of those. Are software engineers really that bad, like people want to remove them? Why? We solve problems (and end up creating more, but the original problem is indeed solved)

- But no one can take the task as happily (or readily)as developers because we are driven by the hunger of understanding, the curiousity that kindles and fires the rest of the way through the solution, no one can easily outsource it.

[I used to like software development, but not anymore](https://blog.kulman.sk/i-used-to-like-software-development-but-not-anymore/)- Nostalgia, I remember I started my programming journey, installing Codeblocks and PyCharm. That was some heck of a task, but the satisfaction of following bucky roberts tutorials and able to understand the stuff, was pure joy.

- Nowadays who needs to understand the variables, no LLM just takes care of it. The depth, the pain of uncomfortable is lost. The joy of finding stackoverflow question is lost.

- Its not just AI or LLMs, but people are just working a bit wired, the mindset, the systems have kind of outgrown humans to productivity myths and its rotting thier brain.

[How do arrays work?](https://nan-archive.vercel.app/how-arrays-work)- Such a sweet little blog post.

- It listed the naive array logic and then also gave a better and more possibilities for the reader to be curious and excited about to try.

[15 Go subtleties you must know](https://harrisoncramer.me/15-go-sublteties-you-may-not-already-know/)- A great post linking some gotchas and quirks about the semantics and syntactic of the language

- Some kf them are quite absurd to be honest, as a developer who has spent 2 years writing in the language.

## Watched
[Richard Sutton on Dwarkesh Patel Podcast](https://youtu.be/21EYKqUsPfg)- It was so deep, like his thinking is so defensive and critical. Some of the points I found out to be contrasting. The start was promising but he started to shade his own points I believe. The math solving problems, which makes sense, but then evolution of human thinking, the built in parameters.

- The point of having intrinsic motivation is not mentioned in the conversation which makes me wonder, why it was not? It was such s distinguishing factor, but he doesn’t wants to distinguish humans, so why try to mimic humans?

[Andrej Karapathy on Dwarkesh Patel Podcast](https://youtu.be/lXUZvyajciY)- I haven’t completed watching it but felt really excited to learn more about LLMs.

- I like the analogy of human brain and the LLM. When we sleep we kind of reset the context window, but update our parameters, we internalise the lessons, we can think and process in the background and connect stuff up.

- I also found it surprising that reaching the state of the art models with 1B parameter would take a decade or so? Kind of practical but considering the frequency of the current releases of models, it looks it could happen almost next year.

[Rust and RAII Memory Management - Computerphile](https://youtu.be/pTMvh6VzDls?si=GSEmB3KadHuv-TdD)- This made me clear. So clear. But still want to put into practise. I have some features to implement for turso database, so in that will be facing those kinds of issues.

[Mikebot 3000 - Can we make a open source video generation ai? Computerphile](https://youtu.be/cP8xpkvs_UI)- Wow, that was hilarious. The lora factor was so ingenuous.

- LLMs are so fascinating.

- The security aspects are worth mentioning. It always depends and will have the effect depending on the direction taken by the mass

## Learnt
comm is a linux utility tool command to compare two files

- I found it used by cursor agent, and was puzzled what the heck was that command, never heard or seen. But to my realization, i didn’t knew this existed. I used to use diff, but this command is more actually like the one that serves the purpose of comparing lines or words in two similar files

How to upgrade from Ubuntu 22.04 to 24.04 without breaking a sweat about your data

`sudo do-release-upgrade`- Just this command should have done the trick, but I am me, and you are you. so.

- I had broken and incompatible packages especially the annoying god knows who and how it installed on my system the one and only libspa-0.2-modules

- The upgrade kind of worked but I rebooted and .. I only saw a tty interface rather than a gui. Oh my god, panic mode

- I opened GPT on my phone, explained to it the problem, and it kind lf gave some genric precautions of the things, I did follow it, not blindly because I had to type them. Reboot, still the same.

- I kept on diging the problems, and realized, I had no internet connection. I relied on WiFi, but the port was not able to work with its own 24.04 drivers. Now, this looked like a chicken and egg problem, I had to install packages, but how do I do it without internet?

- Come in, ethernet, I became so dumb, I didn’t even realise that possibility. Thanks and no thank GPT. Ahhh!

- Tried installing the bazillions of missing packages, reboot, nothing worked. Back to square zero.

- Now I had boiled down the problem to 6-8 packages not getting installed due to conflicts.

- I switched model, I gave the same screenshot or text of that, to Claude, in 2 messages from my end, swoosh, launched the login screen and the desktop environment.

- Thanks Claude, but maybe GPT solved the murky parts so that claude can wipe it one shot. Maybe, but I didn’t care much, I got my system upgraded, I now have bluetooth properly working, hopefully audio would be too.

## Tech News
- OpenAI launches Atlas, the agentic browser

- Anthropic launches claude and claude code on the web

- Deepseek releases Deepseek OCR

For more news, follow the [Hackernewsletter](https://buttondown.com/hacker-newsletter/archive/hacker-newsletter-768) (#768th edition) , and for software development/coding articles, join daily.dev.This would be another busy weekend, guest, travelling a bit on weekends. Might not stream at all. But might build something. Not sure.

That's it from the Diwali week. Happy New Year 🎊(not added by AI)

Happy Coding :)
