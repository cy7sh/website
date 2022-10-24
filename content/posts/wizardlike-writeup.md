---
title: "Writeup: Wizardlike - picoCTF 2022"
date: 2022-10-23
draft: true
showdate: true
---

It was a great feeling of victory to solve this challenge. I was stuck on it for about a day and a half and had almost given up. As always with reverse engineering challenges, I stared out with loading the binary in Ghidra. Inside the symbol tree, we see the entry function which is executed first when the program is run. Upon decompiling we see the following.


![entry function decompilation in ghidra](/images/wizardlike-entry-decompile.png)

`__libc_start_main` looks like it's going to run the functions passed onto it. Let's look at the first one `FUN_0010185b`.

![decompilation of the real entry function](/images/wizardlike-realentry-decompile.png)

Now this looks like the real entry function. If we look at the man pages for the `noecho` and `curs_set`, we see that they are part of the ncurses library which is used to control the terminal. There's a loop and it's is hard to figure out what it does. There's a function with parameter a string consisting of #'s and .'s which are walls and floors on the map. This must have something to do with priting the map on the terminal. At this point, I couldn't figure out anything else just by looking at the decompilation. The first hint suggested to use radare2 for debugging so I knew I had to move to dynamic analysis. I had a pretty bad experience with Ghidra's debugger previously and with the hint suggesting radare2 I didn't even try.

![first hint on picoCTF page](/images/wizardlike-hint.png)

I watched a few liveroverflow videos and tried radare2 on my own readling a bit of the documentation and felt like I couldn't understand shit. I gave up and looked for a walkthrough. I couldn't find one on youtube because I mistook the executable filename (game) for the challenge name (wizardlike). Not finding a walkthrough, I ended up watching [this](https://www.youtube.com/watch?v=xzhiwmFYYkc) video and learned a few basics of radare2. The guy in the video opens the executable in radare2 in debug mode, runs `aaa` to run analysis, `afl` to list functions detected during analysis and disassembles the `main` function listed. I repeated the same with the game binary.

![running above steps on the game binary](/images/wizardlike-r2.png)

Let's seek to the main function with `s main` command, switch to visual mode with `V` command, and repeatedly press "p" until we see a nice-looking disassembly on our screen.

![disassembly of the main function in radare2](/images/wizardlike-r2-main-disass.png)

This looks the the initial entry function we say in ghidra. The first function call might be a call to the real entry function. Press "j" until that call is on top, press "df" to disassemble that function, and we see the the following.

![disassembly of the real entry function in radare2](/images/wizardlike-r2-realentry-disass.png)

Scroll down a bit and we see a loop with some compare instructions that resemble what we saw in the decompilation in Ghidra.

![](/images/wizardlike-1.png)

To figure out what they do, we need to set some breakpoints. We need the rarare2 debugger running on one terminal and the game on the another because it's an interactive program. To do that create a file named "profile.rr2" and populate it with the following. Open another terminal where you want the game to run and run an infinite sleep with `sleep 1000000`.
```
#!/usr/bin/rarun2
stdio=TTY
setenv=TERM=xterm-256color
```
Replace "TTY" with the tty of the terminal you want the game to run on. Find that out by running the `tty` command. The second line sets the TERM environment variable to "xterm-256color" in the environment where the game will be run in. Without it, you get a weird ncurses error. Run radare2 with this profile:
```
r2 -dA -r profile.rr2 game
```
The "-A" flag runs the "aaa" command when radare2 starts. Find the compare instruction and press F2 to set a breakpoint while in visual mode.

![setting breakpont on a compare instruction](/images/wizardlike-2.png)

The "b" after the instruction's address means that a break point was set, you can press F2 again to toggle that. Press "q" to get out of visual mode and run the `dc` command to continue execution until we hit a breakpoint. Check your another terminal and you should have the game running.

![the game running on another tty](/images/wizardlike-3.png)

Let's walk aaround a bit. When we try to walk over to the ">" the game stops and we hit a breakpoint.

![breakpoint hit](/images/wizardlike-4.png)

Switch to the visual mode with "V". We see that the instruction before we stopped is highlighted.

![breakpoint hit in visual mode](/images/wizardlike-5.png)
