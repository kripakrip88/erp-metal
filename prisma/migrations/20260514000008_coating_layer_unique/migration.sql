-- Unique layerNumber per assembly (runtime layers)
ALTER TABLE "assembly_coatings"
    ADD CONSTRAINT "assembly_coatings_assemblyId_layerNumber_key"
    UNIQUE ("assemblyId", "layerNumber");

-- Unique layerNumber per coating system (template layers)
ALTER TABLE "coating_system_layers"
    ADD CONSTRAINT "coating_system_layers_coatingSystemId_layerNumber_key"
    UNIQUE ("coatingSystemId", "layerNumber");
