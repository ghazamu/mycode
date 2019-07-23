#!usr/bin/env python3
import shutil
import os

os.chdir('/home/student/mycode/mycode')
shutil.move('raynor.obj', 'ceph_storage/')

# these lines renames a file
xname = input('What is the new name for kerrygan.obj? ')
shutil.move('ceph_storage/kerrigan.obj','ceph_storage/' + xname)
 
