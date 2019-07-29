#!/usr/bin/env python3

import yaml
def main():
	hitchhikers = [{"name":"Zaphod Beeblebrox","species":"Betlegeusian"}, {"name":"Arthur", "species":"Human"}]
	print(hitchhikers)
	with open("galaxyguide.yaml", "w") as agfile:
		yaml.dump(hitchhikers, agfile)

	yamlstring = yaml.dump(hitchhikers)
	print(yamlstring)

main()