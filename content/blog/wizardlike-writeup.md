---
title: "Writeup: Wizardlike - picoCTF 2022"
date: 2022-10-24
draft: false
showdate: true
---

It was a nice feeling of winning to solve this challenge. I was stuck on it for about a day and a half and had almost given up. With this, I have solved all of the reverse engineering challenges from picoCTF 2022. This was the most fun one so I'm writing this to document how I went about solving it.

As always with reverse engineering challenges, I started out with loading the binary in Ghidra. Inside the symbol tree, we see the entry function which is executed first when the program is run. Upon decompiling we see the following.


![entry function decompilation in ghidra](/images/wizardlike-entry-decompile.png)

`__libc_start_main` looks like it's going to run the functions passed onto it. Let's look at the first one `FUN_0010185b`.

![decompilation of the real entry function](/images/wizardlike-realentry-decompile.png)

Now, this looks like the real entry function. If we look at the man pages for the `noecho` and `curs_set`, we see that they are part of the ncurses library which is used to control the terminal. There's a loop and it's hard to figure out what it does. There's a function with parameter a string consisting of #'s and .'s which are walls and floors on the map. This must have something to do with printing the map on the terminal. At this point, I couldn't figure out anything else just by looking at the decompilation. The first hint suggested using radare2 for debugging so I knew I had to move to dynamic analysis. I had a pretty bad experience with Ghidra's debugger previously and also with the hint suggesting radare2 I didn't even try.

![first hint on picoCTF page](/images/wizardlike-hint.png)

I watched a few liveroverflow videos, tried radare2 on my own reading a bit of the documentation, and felt like I couldn't understand shit. I gave up and looked for a walkthrough. I couldn't find one on youtube because I mistook the executable filename (game) for the challenge name (wizardlike). Not finding a walkthrough, I ended up watching [this](https://www.youtube.com/watch?v=xzhiwmFYYkc) video and learned a few basics of radare2. The guy in the video opens the executable in radare2 in debug mode, runs `aaa` to run analysis, `afl` to list functions detected during analysis, and disassembles the `main` function listed. I repeated the same with the game binary.

![running above steps on the game binary](/images/wizardlike-r2.png)

Let's seek to the main function with `s main` command, switch to visual mode with `V` command, and repeatedly press "p" until we see a nice-looking disassembly on our screen.

![disassembly of the main function in radare2](/images/wizardlike-r2-main-disass.png)

This looks like the initial entry function we saw in Ghidra. The first function call might be a call to the real entry function. Press "j" until that call is on top, press "df" to disassemble that function, and we see the following.

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

![setting breakpoint on a compare instruction](/images/wizardlike-2.png)

The "b" after the instruction's address means that a breakpoint was set, you can press F2 again to toggle that. Press "q" to get out of visual mode and run the `dc` command to continue execution until we hit a breakpoint. Check your other terminal and you should have the game running.

![the game running on another tty](/images/wizardlike-3.png)

Let's walk around a bit. When we try to walk over to the ">" the game stops and we hit a breakpoint.

![breakpoint hit](/images/wizardlike-4.png)

Switch to the visual mode with "V". We see that the instruction where we had set the breakpoint is highlighted.

![breakpoint hit in visual mode](/images/wizardlike-5.png)

We are comparing the eax register against "1" but the value of that register currently is "2" as we can see above. If we keep stepping with F7 we get to the instruction where we compare it against "2" where the comparison is true. Get out of visual mode and continue execution with "dc". We'll get to the second level. Go over the ">" and we hit our breakpoint again.

![](/images/wizardlike-6.png)

This time our eax register has a value of "3". Now we know that this register holds the value of what level we are to move to. Let's see if we can exploit this. There is no way to go to level five within the game due to the broken floor.

![](/images/wizardlike-7.png)

Let's hit the breakpoint when moving to level four and see if we can move to level five instead by editing the register.

![](/images/wizardlike-8.png)

Exit the visual mode and run the command `dr eax=5` to set the value of eax register to 5. Confirm that by listing values of all registers with `dr`.

![](/images/wizardlike-9.png)

Go back to visual mode and keep stepping. If a condition isn't true there's an instruction that resets the value of eax to what it originally was.

![](/images/wizardlike-10.png)

We change the value of eax to 5 again before the instructions to compare it against 4 and 5 run. Before them, it doesn't matter because none of those comparisons are going to be true anyway. We keep stepping instruction by instruction but it quickly goes into big loops that we have to continue over. We see the level 5 map but when trying to move we again hit the breakpoint with eax set to 4. We do the same maneuver and we hit the breakpoint again with eax set to 4. I figured 4 was stored in at `dword [0x560527d3fe7c]` looking at the instruction in the image above and if I could change the value of that variable somehow we could fix everything. But, I couldn't figure out a way to change that in radare2 so I moved over to Ghidra. Towards the end of the real entry function, we notice the following if statement.

![](/images/wizardlike-11.png)

If we encounter ">" we increase something by 1 and if we encounter "<" we decrease that thing by one. What happens when we encounter them in the game? We change levels! Find the corresponding assembly instruction in the listing for the increment statement.

![](/images/wizardlike-12.png)

We can patch this instruction so that it adds 4 instead of 1 so that when we reach ">" in the first level we progress straight to level 5. Right-click on that ADD instruction, click on "Patch Instruction" and change the value from 0x1 to 0x4.

![](/images/wizardlike-13.png)

Go to File > Export Program, set the format to "ELF", export the binary, and run it. Now when we hit ">" for the first time we go straight to level 5. I kept repatching the binary until I had explored every level but didn't find the flag. I thought this would be it. The second hint hints at teleportation, let's try finding something related to the position in Ghidra.

![](/images/wizardlike-14.png)

Again in the real entry function, we see a block of code that looks very interesting on a closer look.

![](/images/wizardlike-15.png)

It takes the value returned by `wgetch()` and runs several if's on them and executes a function on four of them. `wgetch()` is an ncurses library to read a character input on the terminal. Four of them execute a function and there are four movement keys. The last four if statements probably check if any of the movement keys are pressed and call the respective functions for changing the player position on the terminal. Let's look at one of those functions.

![](/images/wizardlike-16.png)

We first call a function with parameters that look like the x-axis position and y-axis position. This is probably run when we press the "D" button to move down the y-axis. Looking at this function call from other functions from the if statements confirms this. If this function does not return a null character only then the rest of the code is executed. This could be a function that checks if a movement is possible and returns a null character when that's false. If we get a null character, we make the movement otherwise we don't. Let's look at the decompilation of this function.

![](/images/wizardlike-17.png)

We do some checks against "#" and " " and return 0 if they are true. This was represented by a null character in the previous function. The parent if statement probably checks if the passed position is within the boundary or something. Let's patch the binary so that this function always returns 1 and every move is possible in the game. It's not technically teleportation as said in the hint but we'll be able to go anywhere on the map!

![](/images/wizardlike-18.png)

In the disassembly listing, whatever we move to EAX is the return value. Patch so that it looks like this:

![](/images/wizardlike-19.png)

Let's run the patched binary and try going to places we couldn't before.

![](/images/wizardlike-20.png)

We see the first piece of the flag! Doing the same on other levels we can find rest of the flag. Don't forget to set the level step back to +1 that we had patched previously.
