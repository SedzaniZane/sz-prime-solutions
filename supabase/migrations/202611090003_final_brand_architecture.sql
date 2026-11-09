-- Final SZ Prime brand architecture
-- Renames legacy business_unit enum values without dropping data.

alter type business_unit rename value 'sz_pristine' to 'pristine_cleaning';
alter type business_unit rename value 'zandou_living' to 'prime_living';
alter type business_unit rename value 'zandou_relocations' to 'prime_relocations';
alter type business_unit rename value 'zandou_connect' to 'prime_plug_connect';
alter type business_unit rename value 'sz_prime_facilities' to 'prime_facilities';
alter type business_unit rename value 'sz_business_solutions' to 'prime_business_solutions';
alter type business_unit rename value 'sz_tech_hub' to 'prime_tech_hub';
