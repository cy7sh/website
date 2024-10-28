---
title: "Introducing Peasycrypt"
date: 2022-09-29
draft: true
---


Encryption is a strong tool, but it's very cumbersome to implement. I'll take an example of a popular encryption tool, Veracrypt. It's a good tool in fact it's the best disk-encryption software. It's amazing to have a drive full of secret stuff but it's not always practical. The other option is to have an empty partition and dedicate it to Veracrypt so you have your unencrypted partitions for OS or whatever. But, having to fiddle with disk partitions is a nightmare. You might not be able to squeeze in an empty partition on your already partitioned drive. The main issue however is that you can't accurately predict how big of a partition you'd need. Over time, you'll want to encrypt more and more of your data. There is a way to expand a Veracrypt partition in Windows according to [this](https://www.reddit.com/r/VeraCrypt/comments/i481eu/comment/g1tyljd/) reddit answer, but I don't think you should count on that. Even if it was possible within Veracrypt, you'd again have to deal with a partitioning nightmare to find space to expand that Veracrypt partition. Now, there are file containers. They avoid you having to deal with disk partitioning and live inside an already existing filesystem. It works by creating a file that serves as an encrypted container. You can mount it like you'd with an encrypted drive or partition. The problem with this again is that it doesn't scale. For example, you create a file container of 10 GB. It's full but you have more data to encrypt. There's no way to expand the size of that container. You can create another file container, but managing multiple file containers becomes a hassle since they obviously behave like independent encrypted containers. This is what Peasycrypt attempts to solve by providing a fully scalable way to encrypt data without needing to dedicate zero space beforehand. A Peasycrypt container is a directory that lives inside an already existing filesystem, uses only as much storage as necessary to store your data, and can behave as an independent filesystem if you want it to with a mount.

### Encrypting
To encrypt a directory `src` and put encrypted contents to `dst` just run the following. We'll call the directory storing encrypted stuff an encrypted container.
```
peasycrypt encrypt src dst
```
Every file and directory's name and data inside src will be encrypted. The directory structure will be preserved.
```
test/
├── crypt
│   ├── N6WKL2MYJWWIPZWX3JDGIZNJZA======
│   │   ├── CGCJTJLM4JNSAPOXNGM3GKQKLM======
│   │   └── JEKQ5W7EBBGACXZOCU6QCNFUL4======
│   └── ZVVAYCOAILYI7GRNZ7YG6VGZUY======
│       ├── GHNM7O5RFLH3JLTVAA7NYKIZWU======
│       └── SKRNQFQHQXYXXJ6VFQC7PIAFCI======
└── plain
    ├── text
    │   ├── hello.txt
    │   └── hi.txt
    └── videos
        ├── nicer
        └── sample.mp4
```
I'll soon add an option to delete the original files once they have been encrypted to `dst` so that the free space required is less than two times the size of `src` in cases where `src` consists of multiple files.

### Mounting
The primary feature of Peasycrypt will be mounts. This will mount a filesystem that will behave like a normal unencrypted filesystem. You will be able to view your encrypted stuff and create, copy or move things to this filesystem and they will be stored encrypted as well. The command will look something like this where `src` is the encrypted container you wish to mount.
```
peasycrypt mount src mountpoint
```
### Inspiration
This project is inspired by the crypt remote in rclone. This is a wrapper for some other remote. Let's say you set the source for crypt to be a directory `src` in remote R. Now you can copy stuff to crypt and it will store them encrypted in the `src` directory in remote R. When you mount the crypt remote, you will see a filesystem hosting contents of `src` directory after being unencrypted. Now you can move things to that mount and it'll encrypt and upload them to `src`. There is no need to allocate space beforehand like you'd need to do for Veracrypt containers. I use this for my google drive and I like the way it works. So, I started this project to make file encryption easy peasy for more people. I hope it will continue to be a good learning experience looking at rclone's code to figure out how it works and writing peasycrypt.

Find the project on GitHub: https://github.com/singurty/peasycrypt
