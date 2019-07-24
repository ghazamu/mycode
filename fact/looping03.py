#!/usr/bin/env python3
#this library allows us to generate uuid values.
import uuid

howmany = int(input("How many UUIDs should be generated? "))

print("Generating UUIDs...")

# range is required because an int cannot be looped
for rando in range(howmany):
    print( uuid.uuid4() )