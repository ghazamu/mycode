#!/usr/bin/env python3
import subprocess  ## <-------- changed
subprocess.call(["ip", "link", "show", "up"])
print("This program will check your interfaces.")
interface = input("Enter an interface, like, ens3: ")
subprocess.call(["ip", "route", interface])  ## <--- changed
subprocess.call(["ip", "a", interface]) ## <--- changed