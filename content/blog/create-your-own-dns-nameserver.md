---
title: "Create your own DNS nameserver"
date: 2024-01-22T17:02:30-05:00
draft: false
showdate: true
---

When you buy a domain from a register, the registrar usually includes their nameserver service so you don't really get to understand what that means or how does it work. A nameserver is responsible for answering queries about the different records that exist for a domain. Look at the following zone configuration file for shirish.ca:

```
;
; BIND data file for shirish.ca
;
$TTL    604800
@       IN      SOA     shirish.ca. root.shirish.ca. (
                        2024012201      ; Serial
                         604800         ; Refresh
                          86400         ; Retry
                        2419200         ; Expire
                         604800 )       ; Negative Cache TTL
;
@       IN      NS      ns1.shirish.ca.
@       IN      NS      ns2.shirish.ca.
@       IN      A       159.203.53.70
www     IN      CNAME   @
ns1     IN      A       159.203.53.70
ns2     IN      A       159.203.18.137
_matrix._tcp    3600    IN      SRV     10      5 8448  @
_matrix-fed._tcp        3600    IN      SRV     10      5 8448  @

```

These records exist on the nameserver for the shirish.ca domain. When someone wants to resolve shirish.ca to an ip address, they first query the root, which provides the .ca top-level domain servers. Then, they query the TLD domain servers which provide the domain's authoritative nameservers which in this case are ns1.shirish.ca and ns2.shirish.ca.  But, the nameservers exist within the domain itself. How would anyone know what is the address for ns1.shirish.ca? This is called a circular reference and it's where glue records come into play. Glue records are created at a domain's registrar and is served by the TLD nameserver, in this case the .ca nameserver.

I have two nameservers for my domain, but we are going to ignore the second one for the sake of simplicity.

Go to your registrar and add the glue records that resolve to your nameservers. I'm using namecheap and this is how I have done it:

![Image showing glue records that resolve ns1.shirish.ca and ns2.shirish.ca to their IP addresses](/images/nameserver-1.png)

Those domains can now resolve your custom nameserver's IP address. We still need to set our authoritative nameserver for our domain to point to our DNS server.

![Image showing name servers for shirish.ca domain as ns1.shirish.ca and ns2.shirish.ca](/images/nameserver-2.png)

These changes take some time to reflect worldwide. You can check the propagation progress on [this](https://www.whatsmydns.net/) website.

Now, we need to actually setup a DNS server. I will be doing this on a Ubuntu 22.04 running on a DigitalOcean VPS.

Install the bind9 and dnsutils packages. Bind9 is the DNS server we will be using and dnsutils package comes with useful tools for testing and troubleshooting DNS issues.

```
# apt install bind9 dnsutils
```
*Every command that starts with # should be executed as root*.

The primary config file for bind9 is at `/etc/bind/named.conf`, which includes three other files with their respective purpose:

- `/etc/bind/named.conf.optinos`: global DNS options
- `/etc/bind/named.conf.local`: config for your zones
- `/etc/bind/named.conf.default-zones`: default zones including localhost, its reverse, and root hints

The default configuration makes your server act as a DNS caching server. Edit `/etc/bind/named.conf.options` to set the IP addresses of the DNS servers you wish to use.
```
forwarders {
  1.1.1.1;
  8.8.8.8;
}
```

Now, we will add a DNS zone to our bind9 config. Add the following to your `/etc/bind9/named.conf.loca` file:

```
zone "shirish.ca" {
        type master;
        file "/etc/bind/db.shirish.ca";
};
```
Obviously replace shirish.ca with your domain in this entire tutorial. Check the validity of your config file with `named-checkconf` command. If it doesn't output anything, that means everything is fine. It is a good ideaa to run these checks everytime you change your config or zone file.
```
$ named-checkconf named.conf.local
```

Use an existing zone file as a template to create your zone file:
```
# cp /etc/bind/db.local /etc/bind/db.shirish.ca
```
Edit the zone file and change `localhost.` to the FQDN of your domain. Always leave an additional `.` at the end when writing DNS records. Change `root.localhost` to an email address you'd like to use, but replace `@` with a `.`. Change the top comment to indicate the domain this file is for. I have created an A record for the base doman, a CNAME record for www, and A records for ns1 and ns2. I also have some SRV records for my matrix server. You may create any additional records you like, but A records for the base domain and your nameservers are essential.
```
;
; BIND data file for shirish.ca
;
$TTL    604800
@       IN      SOA     shirish.ca. root.shirish.ca. (
                        2024012201      ; Serial
                         604800         ; Refresh
                          86400         ; Retry
                        2419200         ; Expire
                         604800 )       ; Negative Cache TTL
;
@       IN      NS      ns1.shirish.ca.
@       IN      NS      ns2.shirish.ca.
@       IN      A       159.203.53.70
www     IN      CNAME   @
ns1     IN      A       159.203.53.70
ns2     IN      A       159.203.18.137
_matrix._tcp    3600    IN      SRV     10      5 8448  @
_matrix-fed._tcp        3600    IN      SRV     10      5 8448  @

```
This is how it should look like. You can use the `named-checkzone` command to check the validity of your zone file.
```
$ named-checkzone db.shirish.ca
```
You should increase the serial number every time you make any change to your zone file. It is a good practice to use the date you make the change as the serial number, like the one on my zone file, *2024012201* which is *yyymmddss* (*ss* is the serial number). Also, you should restart the bind9 service when you make a change.
```
# systemctl restart bind9
```
Check your dns records with the following command:
```
$ dig shirish.ca any
```
The output for my domain is:
```
shirish.ca.             78873   IN      A       159.203.53.70
shirish.ca.             86400   IN      NS      ns1.shirish.ca.
shirish.ca.             86400   IN      NS      ns2.shirish.ca.
shirish.ca.             86400   IN      SOA     ns1.shirish.ca. root.shirish.ca. 2024012401 1200 120 2419200 86300

;; ADDITIONAL SECTION:
ns1.shirish.ca.         78873   IN      A       159.203.53.70
ns2.shirish.ca.         78873   IN      A       159.203.18.137
```
As you can see, this matches the records I had set in my zone file.

Your forward zone is ready and can resolve domain names to their IP addresses. Now, we are going to setup a reverse zone to resolve IP addresses to domain names.

Edit `/etc/bind/named.conf.local` and add the following:
```
zone "53.203.159.in-addr.arpa" {
        type master;
        file "/etc/bind/db.159";
};
```
Replace 53.203.159 of the first three octets of the IP address you are setting up a reverse zone for.
Create the `/etc/bind/db.159` (replace 159 with the first octet of your IP) with the `/etc/bind/db.127` file as a template.
```
# cp /etc/bind/db.127 /etc/bind/db.159
```
Edit the file like this:
```
;
; BIND reverse data file for 159.203.53.XX
;
$TTL    604800
@       IN      SOA     localhost. root.localhost. (
                        2024011701      ; Serial
                         604800         ; Refresh
                          86400         ; Retry
                        2419200         ; Expire
                         604800 )       ; Negative Cache TTL
;
@       IN      NS      ns.
70      IN      PTR     ns1.shirish.ca.
```
If anyone does reverse lookup for the address 159.203.53.70, they will be pointed to the domain ns1.shirish.ca. Check for validity and restart bind9 to make this effective.
```
$ named-checkzone /etc/bind/db.159
```
If it doesn't output anything, everything is fine.
```
# systemctl restart bind9
```
