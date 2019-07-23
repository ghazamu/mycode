#!usr/bin/env python3

pets = [2, "cats", 3, "dogs"]

print ("I have", pets[2], pets[1], "and", pets[0], pets[3],".")
print (f"I have {pets[2]} {pets[1]} and {pets[0]} {pets[-1]}.")
print ("I have {2} {1} and {0} {3}.".format(*pets))