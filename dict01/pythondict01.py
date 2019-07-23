#! /usr/bin/env python3
## create a dictionary
switch = {'hostname': 'sw1', 'ip':'10.0.1.1', 'version': '1.2', 'vendor': 'cisco'}

## display parts of the dictionary
print(switch['hostname'])
print(switch['ip'])

## request a fake key
#print(switch['lynx'])

## request a fake key with .get() method
print("first key test - ,get()")
print(switch.get('lynx'))

## Second test .get() method
print(switch.get('lynx', "THE KEY IS IN ANOTHER CASTLE!"))

## Third test .get() method
print(switch.get('version'))

print("Fourth test - .Keys()")
print (switch.keys())

print("Fifth test - .values()")
print (switch.values())


print("Sixth test - .pop()")
switch.pop('version')
print (switch.keys())
print (switch.values())

print("Seventh test - Add new value")
switch['Admin login'] = "karl08"
print (switch.keys())
print (switch.values())


print("Sixth test - Add new value")
switch['pasword'] = "qwerty"
print (switch.keys())
print (switch.values())






