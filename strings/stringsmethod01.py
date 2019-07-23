#! /usr/bin/env python3
#create a small string
str1 = "Alta3 Research offers classes on Python coding"
newlist = str1.split(" ") # this returns a list
print(newlist)

# create a list of strings
myiplist = ["192", "168", "0", "12"]
# set singleip as the result of joining the myiplist around the "."

singleip = (".").join(myiplist)
print (singleip)